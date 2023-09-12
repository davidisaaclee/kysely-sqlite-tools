import type { DatabaseConnection, Driver, QueryResult } from 'kysely'
import { CompiledQuery } from 'kysely'
import type { EmitterOnce } from './mitt'
import MittOnce from './mitt'
import type { EventWithError, MainMsg, WorkerMsg } from './type'
import type { WaSqliteWorkerDialectConfig } from '.'

export class WaSqliteWorkerDriver implements Driver {
  private config: WaSqliteWorkerDialectConfig
  private worker?: Worker
  private connection?: DatabaseConnection
  private connectionMutex = new ConnectionMutex()
  private mitt?: EmitterOnce<EventWithError>
  constructor(config: WaSqliteWorkerDialectConfig) {
    this.config = config
  }

  async init(): Promise<void> {
    this.worker = this.config.worker
      ?? new Worker(new URL('./worker', import.meta.url), { type: 'module' })
    this.mitt = MittOnce<EventWithError>()
    this.worker.onmessage = ({ data: { type, ...msg } }: MessageEvent<WorkerMsg>) => {
      this.mitt?.emit(type, msg)
    }
    const msg: MainMsg = {
      type: 'init',
      dbName: this.config.dbName,
      url: this.config.url,
    }
    this.worker.postMessage(msg)
    await new Promise<void>((resolve, reject) => {
      this.mitt?.once('init', ({ err }) => {
        err ? reject(err) : resolve()
      })
    })
    this.connection = new WaSqliteWorkerConnection(this.worker, this.mitt)

    await this.config.onCreateConnection?.(this.connection)
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    // SQLite only has one single connection. We use a mutex here to wait
    // until the single connection has been released.
    await this.connectionMutex.lock()
    return this.connection!
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('begin'))
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('commit'))
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('rollback'))
  }

  async releaseConnection(): Promise<void> {
    this.connectionMutex.unlock()
  }

  async destroy(): Promise<void> {
    if (!this.worker) {
      return
    }
    this.worker.postMessage({
      type: 'close',
    })
    return new Promise<void>((resolve, reject) => {
      this.mitt?.once('close', ({ err }) => {
        if (err) {
          reject(err)
        } else {
          this.worker?.terminate()
          this.mitt?.all.clear()
          this.mitt = undefined
          resolve()
        }
      })
    })
  }
}

class ConnectionMutex {
  private promise?: Promise<void>
  private resolve?: () => void

  async lock(): Promise<void> {
    while (this.promise) {
      await this.promise
    }

    this.promise = new Promise((resolve) => {
      this.resolve = resolve
    })
  }

  unlock(): void {
    const resolve = this.resolve

    this.promise = undefined
    this.resolve = undefined

    resolve?.()
  }
}

class WaSqliteWorkerConnection implements DatabaseConnection {
  readonly worker: Worker
  readonly mitt?: EmitterOnce<EventWithError>
  constructor(worker: Worker, mitt?: EmitterOnce<EventWithError>) {
    this.worker = worker
    this.mitt = mitt
  }

  streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('Sqlite driver doesn\'t support streaming')
  }

  async executeQuery<R>(compiledQuery: CompiledQuery<unknown>): Promise<QueryResult<R>> {
    const { parameters, sql, query } = compiledQuery
    const mode = query.kind === 'SelectQueryNode'
      ? 'query'
      : query.kind === 'RawNode'
        ? 'raw'
        : 'exec'
    const msg: MainMsg = { type: 'run', mode, sql, parameters }
    this.worker.postMessage(msg)
    return new Promise((resolve, reject) => {
      if (!this.mitt) {
        reject('kysely instance has been destroyed')
      }
      this.mitt!.once('run', ({ data, err }) => {
        (!err && data) ? resolve(data) : reject(err)
      })
    })
  }
}

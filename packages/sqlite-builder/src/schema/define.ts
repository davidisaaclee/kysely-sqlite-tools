import type { RawBuilder } from 'kysely'
import type { IsNotNull } from '@subframe7536/type-utils'
import type {
  ColumnType,
  Columns,
  ColumnsWithErrorInfo,
  Table,
  TableProperty,
  TimeTriggerOptions,
} from './types'

export const TGR = '__TIME_TRIGGER__'

/**
 * define table
 *
 * you can use it with {@link Column}
 *
 * @example
 * const testTable = defineTable({
 *   id: Column.Increments(),
 *   // or just object
 *   simple: { type: 'string', defaultTo: 'test' }
 *   person: Column.Object({ name: 'test' }),
 *   gender: Column.Boolean().NotNull(),
 *   array: Column.Object<string[]>(),
 *   literal: Column.String<'l1' | 'l2'>(),
 *   buffer: Column.Blob(),
 * }, {
 *   primary: 'id',
 *   index: ['person', ['id', 'gender']],
 *   timeTrigger: { create: true, update: true },
 * })
 */
export function defineTable<
  T extends Columns,
  C extends string | true | null = null,
  U extends string | true | null = null,
>(
  columns: T,
  property?: Omit<TableProperty<T>, 'timeTrigger'> & {
    timeTrigger?: TimeTriggerOptions<C, U>
  },
): Table<T, C, U> {
  const { create, update } = property?.timeTrigger || {}
  const options = { type: 'date', defaultTo: TGR }
  if (create === true) {
    // @ts-expect-error assign
    columns.createAt = options
  } else if (create) {
    // @ts-expect-error assign
    columns[create] = options
  }
  if (update === true) {
    // @ts-expect-error assign #hack
    columns.updateAt = { ...options, notNull: 0 }
  } else if (update) {
    // @ts-expect-error assign #hack
    columns[update] = { ...options, notNull: 0 }
  }
  return {
    columns: columns as unknown as ColumnsWithErrorInfo<T>,
    ...property,
  }
}

function base<T>(type: ColumnType, defaultTo?: T | RawBuilder<unknown> | null) {
  const base = {
    type,
    defaultTo: defaultTo as IsNotNull<typeof defaultTo> extends true ? T : T | null,
  } as const
  return {
    ...base,
    NotNull() {
      return {
        ...base,
        notNull: true,
      } as const
    },
  }
}

/**
 * define column
 */
export const Column = {
  /**
   * column type: text
   */
  String: <T extends string>(defaultTo?: T | RawBuilder<unknown> | null) => base('string', defaultTo),
  /**
   * column type: integer
   */
  Int: <T extends number>(defaultTo?: T | RawBuilder<unknown> | null) => base('int', defaultTo),
  /**
   * column type: real
   */
  Float: <T extends number>(defaultTo?: T | RawBuilder<unknown> | null) => base('float', defaultTo),
  /**
   * column type: blob
   */
  Blob: () => base<ArrayBufferLike>('blob'),
  /**
   * column type: interger auto increment
   */
  Increments: () => ({ type: 'increments' } as const),
  /**
   * column type: text (parse with `JSON.parse`)
   */
  Boolean: (defaultTo?: boolean | RawBuilder<unknown> | null) => base('boolean', defaultTo),
  /**
   * column type: text (parse with `JSON.parse`)
   */
  Date: (defaultTo?: Date | RawBuilder<unknown> | null) => base('date', defaultTo),
  /**
   * column type: text (parse with `JSON.parse`)
   */
  Object: <T extends object>(defaultTo?: T | RawBuilder<unknown> | null) => base('object', defaultTo),
}

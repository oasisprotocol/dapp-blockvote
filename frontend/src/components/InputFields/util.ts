import { MarkdownCode } from '../../types'

export type FieldMessageType = 'info' | 'warning' | 'error'

export type FieldMessage = {
  signature?: string
  text: MarkdownCode
  type?: FieldMessageType
}

export type MessageMaybeAtLocation = FieldMessage & { location?: string }
export type MessageAtLocation = FieldMessage & { location: string }

export type ValidatorOutput = MessageMaybeAtLocation | string | undefined

export const wrapValidatorOutput = (
  output: ValidatorOutput,
  defaultLocation: string,
  defaultLevel: FieldMessageType,
): MessageAtLocation | undefined => {
  if (output === undefined || output === '') return undefined
  if (typeof output === 'string') {
    const cutPos = output.indexOf(':')
    if (cutPos !== -1) {
      const signature = output.substring(0, cutPos)
      if (!signature.includes(' ')) {
        return {
          signature,
          text: output.substring(cutPos + 1).trim(),
          type: defaultLevel,
          location: defaultLocation,
        }
      }
    }
    return {
      text: output,
      type: defaultLevel,
      location: defaultLocation,
    }
  } else {
    const report = output as MessageMaybeAtLocation
    return {
      ...report,
      type: report.type ?? 'error',
      location: report.location ?? defaultLocation,
    }
  }
}

export function flatten<Data>(array: Data[][]): Data[] {
  const result: Data[] = []
  array.forEach(a => a.forEach(i => result.push(i)))
  return result
}

export type AllMessages = Record<string, FieldMessage[]>

export type ValidatorControls = {
  isStillFresh: () => boolean
  updateStatus: (status: { message?: string; progress?: number }) => void
}

export type SyncValidatorFunction<DataType> = (
  value: DataType,
  controls: ValidatorControls,
  reason: string,
) => SingleOrArray<ValidatorOutput>
export type AsyncValidatorFunction<DataType> = (
  value: DataType,
  controls: ValidatorControls,
  reason: string,
) => Promise<SingleOrArray<ValidatorOutput>>
export type ValidatorFunction<DataType> = SyncValidatorFunction<DataType> | AsyncValidatorFunction<DataType>

export const checkMessagesForProblems = (messages: FieldMessage[] = []) => ({
  hasWarning: messages.some(message => message.type === 'warning'),
  hasError: messages.some(message => message.type === 'error'),
})

export type SingleOrArray<Data> = Data | Data[]

export function getAsArray<Data>(data: SingleOrArray<Data>): Data[] {
  return Array.isArray(data) ? data : [data]
}

export const thereIsOnly = (amount: number) => {
  if (!amount) {
    return 'there is none'
  } else if (amount == 1) {
    return 'there is only one'
  } else {
    return `there are only ${amount}`
  }
}

export const atLeastXItems = (amount: number): string => {
  if (amount > 1) {
    return `at least ${amount} items`
  } else if (amount === 1) {
    return `at least one item`
  } else {
    throw new Error(`What do you mean by 'at least ${amount} items??'`)
  }
}

type NumberStringFunction = (amount: number) => string
export type NumberMessageTemplate = string | NumberStringFunction

export const getNumberMessage = (template: NumberMessageTemplate, amount: number): string =>
  typeof template === 'string' ? (template as string) : (template as NumberStringFunction)(amount)

type DateStringFunction = (date: Date) => string
export type DateMessageTemplate = string | DateStringFunction

export const getDateMessage = (template: DateMessageTemplate, date: Date): string =>
  typeof template === 'string' ? (template as string) : (template as DateStringFunction)(date)

/**
 * Get the indices of duplicate elements in an array
 */
export const findDuplicates = (
  values: string[],
  normalize?: (value: string) => string,
): [number[], number[]] => {
  const matches: Record<string, number> = {}
  const hasDuplicates = new Set<number>()
  const duplicates = new Set<number>()
  values.forEach((value, index) => {
    const key = normalize ? normalize(value) : value
    if (matches[key] !== undefined) {
      hasDuplicates.add(matches[value])
      duplicates.add(index)
    } else {
      matches[key] = index
    }
  })
  return [Array.from(hasDuplicates.values()), Array.from(duplicates.values())]
}

type SimpleDecision = boolean
type FullDecision = { verdict: boolean; reason?: MarkdownCode | undefined }
export type Decision = SimpleDecision | FullDecision

type FullPositiveDecision = { verdict: true; reason: MarkdownCode }
type FullNegativeDecision = { verdict: false; reason: MarkdownCode }
export type DecisionWithReason = true | FullPositiveDecision | FullNegativeDecision

export const allow = (reason?: MarkdownCode | undefined): Decision => ({ verdict: true, reason: reason })
export const deny = (reason?: MarkdownCode | undefined): Decision => ({ verdict: false, reason: reason })
export const denyWithReason = (reason: MarkdownCode): FullNegativeDecision => ({
  verdict: false,
  reason: reason,
})

export const expandDecision = (decision: Decision): FullDecision =>
  typeof decision === 'boolean' ? { verdict: decision } : decision

export const invertDecision = (decision: Decision): Decision => {
  const { verdict, reason } = expandDecision(decision)
  return {
    verdict: !verdict,
    reason,
  }
}

export const andDecisions = (a: Decision, b: Decision): Decision => {
  const aVerdict = getVerdict(a, false)
  const bVerdict = getVerdict(b, false)
  if (aVerdict) {
    if (bVerdict) {
      return {
        verdict: true,
        reason: `${getReason(a) as string}; ${getReason(b) as string}`,
      }
    } else {
      return b
    }
  } else {
    return a
  }
}

export const getVerdict = (decision: Decision | undefined, defaultVerdict: boolean): boolean =>
  decision === undefined ? defaultVerdict : typeof decision === 'boolean' ? decision : decision.verdict

export const getReason = (decision: Decision | undefined): MarkdownCode | undefined =>
  decision === undefined ? undefined : typeof decision === 'boolean' ? undefined : decision.reason

export const getReasonForDenial = (decision: Decision | undefined): MarkdownCode | undefined =>
  decision === undefined
    ? undefined
    : typeof decision === 'boolean' || decision.verdict
      ? undefined
      : decision.reason

export const getReasonForAllowing = (decision: Decision | undefined): MarkdownCode | undefined =>
  decision === undefined
    ? undefined
    : typeof decision === 'boolean' || !decision.verdict
      ? undefined
      : decision.reason

export type CoupledData<FirstType = boolean, SecondType = string> = [FirstType, SecondType] | FirstType

export function expandCoupledData<FirstType, SecondType>(
  value: CoupledData<FirstType, SecondType> | undefined,
  fallback: [FirstType, SecondType],
): [FirstType, SecondType] {
  if (value === undefined) {
    return fallback
  } else if (Array.isArray(value)) {
    return value
  } else {
    return [value, fallback[1]]
  }
}

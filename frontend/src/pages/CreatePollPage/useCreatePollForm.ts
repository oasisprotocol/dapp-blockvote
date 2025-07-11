import { useEffect, useState } from 'react'
import {
  doFieldsHaveAnError,
  deny,
  FieldConfiguration,
  FieldLike,
  validateFields,
  flatten,
  useBooleanField,
  useDateField,
  useLabel,
  useOneOfField,
  useTextArrayField,
  useTextField,
  useAction,
} from '../../components/InputFields'
import { createPoll as doCreatePoll, parseEther, CreatePollProps } from '../../utils/poll.utils'
import { useContracts } from '../../hooks/useContracts'
import classes from './index.module.css'
import { DateUtils } from '../../utils/date.utils'
import { useTime } from '../../hooks/useTime'
import {
  designDecisions,
  MIN_COMPLETION_TIME_MINUTES,
  nativeTokenName,
  VITE_APP_HARDWIRED_ACL,
  VITE_APP_HARDWIRED_RESULTS_DISPLAY,
} from '../../constants/config'

import { useNavigate } from 'react-router-dom'
import { acls } from '../../components/ACLs'
import { getPollPath } from '../../utils/path.utils'
import { useEthereum } from '../../hooks/useEthereum'
import { StringUtils } from '../../utils/string.utils'
import { getLink } from '../../utils/markdown.utils'

// The steps / pages of the wizard
const stepTitles = {
  basics: 'Poll creation',
  permission: 'Pre-vote settings',
  results: 'Results settings',
} as const

type CreationStep = keyof typeof stepTitles
const process: CreationStep[] = Object.keys(stepTitles) as CreationStep[]
const numberOfSteps = process.length

const expectedRanges = {
  '1-100': 100,
  '100-1000': 1000,
  '1000-10000': 10000,
  '10000-': 100000,
} as const

export const useCreatePollForm = () => {
  const { explorerBaseUrl } = useEthereum()
  const { eth, pollManagerWithSigner: daoSigner } = useContracts()

  const [step, setStep] = useState<CreationStep>('basics')
  const [stepIndex, setStepIndex] = useState(0)

  const navigate = useNavigate()

  const title = useLabel({
    name: 'title',
    value: stepTitles[step],
    tagName: 'h2',
  })

  const intro = useLabel({
    name: 'intro',
    value: 'Once created, your poll will be live immediately and responses will start being recorded.',
  })

  const question = useTextField({
    name: 'question',
    label: 'Question',
    placeholder: 'Your question',
    required: [true, 'Please specify the question for your poll!'],
    minLength: [10, minLength => `Please describe the question using at least ${minLength} characters!`],
    maxLength: [80, maxLength => `Please state the question in no more than ${maxLength} characters!`],
  })

  const description = useTextField({
    name: 'description',
    label: 'Description',
    placeholder: 'Please elaborate the question, if you want to.',
  })

  const answers = useTextArrayField({
    name: 'answers',
    label: 'Answers',
    addItemLabel: 'Add answer',
    removeItemLabel: 'Remove this answer',

    initialItemCount: 3, // Let's start with 3 answers.
    placeholderTemplate: index => `Answer ${index + 1}`,
    minItems: [2, minCount => `You need at least ${minCount} answers in order to create this poll.`],
    // Note: the contract only supports 8 options, so we have to keep the UI in sync with that.
    maxItem: [8, maxCount => `Please don't offer more than ${maxCount} answers.`],
    allowDuplicates: [false, ['This answer is repeated below.', 'The same answer was already listed above!']],
    dropEmptyItems: true,
    minItemLength: [1, minLength => `Please use at least ${minLength} characters for this answer.`],
    // maxItemLength: [10, maxLength => `Please don't use more than ${maxLength} characters for this answer.`],
  })

  const customCSS = useBooleanField({
    name: 'customCSS',
    label: 'I want to create a customized theme for the poll',
    enabled: deny('Coming soon!'),
    hidden: designDecisions.hideUnderConstructionFeatures,
  })

  const hidden = useBooleanField({
    name: 'hidden',
    label: 'Hidden poll',
    description:
      "If enabled, poll can only be accessed via the specific URL, but won't appear in any searches or dashboards.",
  })

  const accessControlMethod = useOneOfField({
    name: 'accessControlMethod',
    label: 'Who can vote',
    choices: acls,
    initialValue: VITE_APP_HARDWIRED_ACL,
    enabled: !VITE_APP_HARDWIRED_ACL,
    visible: !designDecisions.hideHardwiredSettings || !VITE_APP_HARDWIRED_ACL,
  } as const)

  const aclConfig = acls.map(acl => ({
    name: acl.value,
    ...acl.useConfiguration(acl.value === accessControlMethod.value),
  }))

  const currentAcl = acls.find(acl => acl.value === accessControlMethod.value)!

  const currentAclConfig = aclConfig.find(a => a.name === accessControlMethod.value)!

  const allAclFieldsToShow = flatten(
    aclConfig.map(acl => {
      const addPrefixToName = (f: FieldLike) => ({ ...f, name: `${acl.name}/${f.name}` })

      const rows = acl.fields
      return rows.map(row => {
        if (Array.isArray(row)) {
          return row.map(field => addPrefixToName(field))
        } else {
          return addPrefixToName(row)
        }
      })
    }),
  )

  const gasFree = useBooleanField({
    name: 'gasless',
    label: 'Make this vote gas-free',
  })

  const gasFreeExplanation = useLabel({
    name: 'gasFreeExplanation',
    value: `We calculate and suggest the amount of ${nativeTokenName} needed for gas based on the amount of users that are expected to vote. Any remaining ${nativeTokenName} from the gas sponsoring wallet will be refunded to you once the poll is completed.`,
    visible: gasFree.value,
    classnames: classes.explanation,
  })

  const numberOfExpectedVoters = useOneOfField({
    name: 'numberOfExpectedVoters',
    visible: gasFree.value,
    label: 'Number of voters',
    choices: [
      { value: '1-100', label: 'Less than 100' },
      { value: '100-1000', label: 'Between 100 and 1000' },
      { value: '1000-10000', label: 'Between 1000 and 10,000' },
      { value: '10000-', label: 'Above 10,000' },
    ],
  } as const)

  const amountOfSubsidy = useTextField({
    name: 'suggestedAmountOfRose',
    visible: gasFree.value,
    label: `Amount of ${nativeTokenName} to set aside`,
  })

  useEffect(() => {
    if (!gasFree.value) return
    const cost = currentAcl.costEstimation * expectedRanges[numberOfExpectedVoters.value]
    amountOfSubsidy.setValue(cost.toString())
  }, [gasFree.value, currentAcl, numberOfExpectedVoters.value])

  const [isFrozen, setIsFrozen] = useState(false)

  const frozenMassage = 'Too late to change your mind; we are already creating the poll'

  const resultDisplayType = useOneOfField({
    name: 'resultDisplayType',
    label: 'Type of result display',
    choices: [
      {
        value: 'end_result_only',
        label: 'Show only the end result',
        enabled: deny('Coming soon'),
        hidden: designDecisions.hideUnderConstructionFeatures,
      },
      {
        value: 'percentages',
        label: 'Show percentage for each answer',
      },
      {
        value: 'percentages_and_voters',
        label: 'Show percentage for each answer, plus the list of voters',
        description:
          'The individual votes will still be hidden, only the existence of the vote will be published.',
      },
      {
        value: 'percentages_and_votes',
        label: 'Show percentage and votes for each answer',
        description: 'Everyone can see who voted for what.',
      },
    ],
    initialValue: VITE_APP_HARDWIRED_RESULTS_DISPLAY,
    enabled: isFrozen ? deny(frozenMassage) : !VITE_APP_HARDWIRED_RESULTS_DISPLAY,
    visible: !designDecisions.hideHardwiredSettings || !VITE_APP_HARDWIRED_RESULTS_DISPLAY,
    hideDisabledChoices: designDecisions.hideDisabledSelectOptions,
    hideIfDisabled: designDecisions.hideDisabledSelects,
  } as const)

  const authorResultDisplayType = useOneOfField({
    name: 'authorResultDisplayType',
    label: 'Type of result display for the author',
    visible: resultDisplayType.value !== 'percentages_and_votes',
    choices: [
      {
        value: 'same',
        label: 'Same as for everybody else',
      },
      {
        value: 'also_percentages',
        label: 'Also show percentage for each answer',
        hidden: resultDisplayType.value !== 'end_result_only',
      },
      {
        value: 'voters',
        label: 'Also show the list of voters',
        hidden:
          ['percentages_and_votes', 'percentages_and_voters'].includes(resultDisplayType.value) ||
          designDecisions.hideUnderConstructionFeatures,
        enabled: deny('Coming soon'),
        description:
          'The individual votes will still be hidden, only the existence of the vote will be published.',
      },
      {
        value: 'votes',
        label: 'Also show the votes for each answer',
        description: 'The author can see who voted for what.',
        enabled: deny('Coming soon'),
        hidden: designDecisions.hideUnderConstructionFeatures,
      },
    ],
    hideDisabledChoices: designDecisions.hideDisabledSelectOptions,
    disableIfOnlyOneVisibleChoice: designDecisions.disableSelectsWithOnlyOneVisibleOption,
    hideIfDisabled: designDecisions.hideDisabledSelects,
  } as const)

  const hasCompletionDate = useBooleanField({
    name: 'hasCompletionDate',
    label: 'Fixed completion date',
    enabled: isFrozen ? deny(frozenMassage) : true,
    onValueChange: value => {
      if (value) pollCompletionDate.setValue(new Date(Date.now() + 1000 * 3600))
    },
  })

  const { now } = useTime()

  const pollCompletionDate = useDateField({
    name: 'pollCompletionDate',
    label: `Poll completion date (Time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
    visible: hasCompletionDate.value,
    enabled: isFrozen ? deny(frozenMassage) : true,
    validateOnChange: true,
    showValidationPending: false,
    validators: value => {
      const deadline = value.getTime() / 1000
      const remaining = DateUtils.calculateRemainingTimeFrom(deadline, now)
      const { isPastDue, totalSeconds } = remaining
      if (hasCompletionDate.value && (isPastDue || totalSeconds < MIN_COMPLETION_TIME_MINUTES * 60)) {
        return `Please set a time at least ${MIN_COMPLETION_TIME_MINUTES} minutes in the future!`
      }
    },
  })

  const hasValidCompletionDate =
    hasCompletionDate.value && !!pollCompletionDate.value && !pollCompletionDate.hasProblems

  const pollCompletionLabel = useLabel<string>({
    name: 'pollCompletionLabel',
    visible: hasValidCompletionDate,
    value: hasCompletionDate
      ? (DateUtils.getTextDescriptionOfTime(
          DateUtils.calculateRemainingTimeFrom(pollCompletionDate.value.getTime() / 1000, now),
        ) ?? '')
      : '',
  })

  useEffect(() => {
    void pollCompletionDate.validate({ reason: 'change', isStillFresh: () => true })
  }, [hasCompletionDate.value, now])

  const stepFields: Record<CreationStep, FieldConfiguration> = {
    basics: [question, description, answers, customCSS],
    permission: [
      hidden,
      accessControlMethod,
      ...allAclFieldsToShow,
      gasFree,
      gasFreeExplanation,
      [numberOfExpectedVoters, amountOfSubsidy],
    ],
    results: [
      resultDisplayType,
      authorResultDisplayType,
      hasCompletionDate,
      pollCompletionDate,
      pollCompletionLabel,
    ],
  }

  const goToPreviousStep = useAction({
    name: 'previousStep',
    label: 'Back',
    visible: stepIndex > 0 && !isFrozen,
    size: 'small',
    color: 'secondary',
    variant: 'outline',
    action: () => {
      setStep(process[stepIndex - 1])
      setStepIndex(stepIndex - 1)
    },
  })

  const hasErrorsOnCurrentPage = doFieldsHaveAnError(stepFields[step])

  const goToNextStep = useAction({
    name: 'nextStep',
    label: 'Next',
    visible: stepIndex < numberOfSteps - 1,
    enabled: hasErrorsOnCurrentPage ? deny('Please fix the errors first') : true,
    size: 'small',
    action: async () => {
      const hasErrors = await validateFields(stepFields[step], 'submit', () => true)
      if (hasErrors) return
      setStep(process[stepIndex + 1])
      setStepIndex(stepIndex + 1)
    },
  })

  const createPoll = useAction({
    name: 'createPoll',
    label: 'Create poll',
    pendingLabel: 'Creating poll ...',
    visible: stepIndex === numberOfSteps - 1,
    enabled: hasErrorsOnCurrentPage
      ? deny('Please fix the errors above first!')
      : !daoSigner
        ? deny('Waiting for blockchain connection')
        : !eth.state.address
          ? deny('Waiting for wallet')
          : true,
    size: 'small',
    action: async context => {
      try {
        setIsFrozen(true)
        const aclConfigValues = currentAclConfig.values
        const {
          aclAddress,
          data: aclData,
          options: aclOptions,
          flags: pollFlags,
        } = await currentAcl.getAclOptions(
          aclConfigValues as never, // TODO: why is this conversion necessary?
          context,
        )
        const pollProps: CreatePollProps = {
          question: question.value,
          description: description.value,
          answers: answers.value,
          isHidden: hidden.value,
          aclAddress,
          aclData,
          aclOptions,
          pollFlags,
          subsidizeAmount: gasFree.value ? parseEther(amountOfSubsidy.value) : undefined,
          publishVotes: resultDisplayType.value === 'percentages_and_votes',
          publishVoters: resultDisplayType.value === 'percentages_and_voters',
          completionTime: hasCompletionDate.value ? pollCompletionDate.value : undefined,
          explorerBaseUrl,
        }

        // console.log('Will create poll with props:', pollProps)

        const newId = await doCreatePoll(daoSigner!, eth.state.address!, pollProps, context)
        setIsFrozen(false)
        if (newId) {
          navigate(getPollPath(newId))
        }
      } catch (ex) {
        let exString = `${ex}`
        if (exString.startsWith('Error: user rejected action')) {
          exString = 'Signer refused to sign transaction.'
        } else if (exString.startsWith('Error: transaction execution reverted')) {
          const txHash = (ex as any).receipt.hash
          const txUrl = explorerBaseUrl ? StringUtils.getTransactionUrl(explorerBaseUrl, txHash) : undefined
          const txLink = getLink({ href: txUrl, label: 'transaction' })
          exString = `the ${txLink} has been reverted.`
        }
        console.log(ex)
        setIsFrozen(false)
        throw Error(`Failed to create poll: ${exString}`)
      }
    },
  })

  return {
    stepIndex,
    numberOfSteps,
    fields: [title, intro, ...stepFields[step], [goToPreviousStep, goToNextStep, createPoll]],
  }
}

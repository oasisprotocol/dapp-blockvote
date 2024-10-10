import { useEffect, useState } from 'react'
import {
  collectErrorsInFields,
  deny,
  FieldConfiguration,
  FieldLike,
  findErrorsInFields,
  flatten,
  useBooleanField,
  useDateField,
  useLabel,
  useOneOfField,
  useTextArrayField,
  useTextField,
} from '../../components/InputFields'
import { createPoll as doCreatePoll, parseEther, CreatePollProps } from '../../utils/poll.utils'
import { useContracts } from '../../hooks/useContracts'
import classes from './index.module.css'
import { DateUtils } from '../../utils/date.utils'
import { useTime } from '../../hooks/useTime'
import { designDecisions, MIN_COMPLETION_TIME_MINUTES, nativeTokenName } from '../../constants/config'

import { useNavigate } from 'react-router-dom'
import { acls } from '../../components/ACLs'
import { proposalIdToSlug } from '../../utils/slug'

// The steps / pages of the wizard
const StepTitles = {
  basics: 'Poll creation',
  permission: 'Pre-vote settings',
  results: 'Results settings',
} as const

type CreationStep = keyof typeof StepTitles
const process: CreationStep[] = Object.keys(StepTitles) as CreationStep[]
const numberOfSteps = process.length

const expectedRanges = {
  '1-100': 100,
  '100-1000': 1000,
  '1000-10000': 10000,
  '10000-': 100000,
} as const

export const useCreatePollForm = () => {
  // const eth = useEthereum()
  const { eth, pollManagerWithSigner: daoSigner } = useContracts()

  const [isCreating, setIsCreating] = useState<boolean>(false)
  const [step, setStep] = useState<CreationStep>('basics')
  const [stepIndex, setStepIndex] = useState(0)
  const [validationPending, setValidationPending] = useState(false)

  const navigate = useNavigate()

  const question = useTextField({
    name: 'question',
    label: 'Question',
    placeholder: 'Your question',
    required: [true, 'Please specify the question for your poll!'],
    minLength: [10, minLength => `Please describe the question using at least ${minLength} characters!`],
    maxLength: [80, maxLength => `Please state the question in more more than ${maxLength} characters!`],
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
    initialValue: `We calculate and suggest the amount of ${nativeTokenName} needed for gas based on the amount of users that are expected to vote. Any remaining ${nativeTokenName} from the gas sponsoring wallet will be refunded to you once the poll is completed.`,
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

  const resultDisplayType = useOneOfField({
    name: 'resultDisplayType',
    label: 'Type of result display',
    choices: [
      {
        value: 'end_result_only',
        label: 'Show only the end result',
        enabled: deny('Coming soon'),
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
    hideDisabledChoices: designDecisions.hideDisabledSelectOptions,
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
        hidden: resultDisplayType.value === 'percentages',
      },
      {
        value: 'voters',
        label: 'Also show the list of voters',
        hidden: ['percentages_and_votes', 'percentages_and_voters'].includes(resultDisplayType.value),
        enabled: deny('Coming soon'),
        description:
          'The individual votes will still be hidden, only the existence of the vote will be published.',
      },
      {
        value: 'votes',
        label: 'Also show the votes for each answer',
        description: 'The author can see who voted for what.',
        enabled: deny('Coming soon'),
      },
    ],
    hideDisabledChoices: designDecisions.hideDisabledSelectOptions,
    disableIfOnlyOneVisibleChoice: designDecisions.disableSelectsWithOnlyOneVisibleOption,
  } as const)

  const hasCompletionDate = useBooleanField({
    name: 'hasCompletionDate',
    label: 'Fixed completion date',
    onValueChange: value => {
      if (value) pollCompletionDate.setValue(new Date(Date.now() + 1000 * 3600))
    },
  })

  const { now } = useTime()

  const pollCompletionDate = useDateField({
    name: 'pollCompletionDate',
    label: `Poll completion date (Time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
    visible: hasCompletionDate.value,
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

  const pollCompletionLabel = useLabel({
    name: 'pollCompletionLabel',
    visible: hasValidCompletionDate,
    initialValue: '??',
  })

  useEffect(() => {
    void pollCompletionDate.validate({ reason: 'change', isStillFresh: () => true })
  }, [hasCompletionDate.value, now])

  useEffect(() => {
    if (hasValidCompletionDate) {
      const deadline = pollCompletionDate.value.getTime() / 1000
      const remaining = DateUtils.calculateRemainingTimeFrom(deadline, now)
      pollCompletionLabel.setValue(DateUtils.getTextDescriptionOfTime(remaining) ?? '')
    }
  }, [hasCompletionDate.value, hasValidCompletionDate, now])

  const creationStatus = useLabel({
    name: 'creationStatus',
    label: '',
    initialValue: '',
  })

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
      creationStatus,
    ],
  }

  const goToPreviousStep = () => {
    if (stepIndex === 0) return
    setStep(process[stepIndex - 1])
    setStepIndex(stepIndex - 1)
  }

  const goToNextStep = async () => {
    if (stepIndex === numberOfSteps - 1) return
    setValidationPending(true)
    const hasErrors = await findErrorsInFields(stepFields[step], 'submit', () => true)
    setValidationPending(false)
    if (hasErrors) return
    setStep(process[stepIndex + 1])
    setStepIndex(stepIndex + 1)
  }

  const createPoll = async () => {
    setValidationPending(true)
    const hasErrors = await findErrorsInFields(stepFields[step], 'submit', () => true)
    setValidationPending(false)
    if (hasErrors) return

    if (!daoSigner) throw new Error('DAO signer not found!')
    if (!eth.state.address) throw new Error("Can't find my own address!")

    const logger = (message?: string | undefined) => creationStatus.setValue(message ?? '')

    setIsCreating(true)
    try {
      const aclConfigValues = currentAclConfig.values
      const {
        data: aclData,
        options: aclOptions,
        flags: pollFlags,
      } = await currentAcl.getAclOptions(
        aclConfigValues as never, // TODO: why is this conversion necessary?
        logger,
      )
      const pollProps: CreatePollProps = {
        question: question.value,
        description: description.value,
        answers: answers.value,
        isHidden: hidden.value,
        aclAddress: currentAcl.address,
        aclData,
        aclOptions,
        pollFlags,
        subsidizeAmount: gasFree.value ? parseEther(amountOfSubsidy.value) : undefined,
        publishVotes: resultDisplayType.value === 'percentages_and_votes',
        publishVoters: resultDisplayType.value === 'percentages_and_voters',
        completionTime: hasCompletionDate.value ? pollCompletionDate.value : undefined,
      }

      // console.log('Will create poll with props:', pollProps)

      const newId = await doCreatePoll(daoSigner, eth.state.address, pollProps, logger)

      if (newId) {
        const slug = proposalIdToSlug(newId);
        navigate(`/${slug}`)
      }
    } catch (ex) {
      let exString = `${ex}`
      if (exString.startsWith('Error: user rejected action')) {
        exString = 'Signer refused to sign transaction.'
      }
      logger(`Failed to create poll: ${exString}`)
    } finally {
      setIsCreating(false)
    }
  }

  const hasErrorsOnCurrentPage = collectErrorsInFields(stepFields[step])

  return {
    stepTitle: StepTitles[step],
    stepIndex,
    numberOfSteps,
    fields: stepFields[step],
    previousStep: goToPreviousStep,
    validationPending,
    nextStep: goToNextStep,
    isCreating,
    hasErrorsOnCurrentPage,
    createPoll,
  }
}

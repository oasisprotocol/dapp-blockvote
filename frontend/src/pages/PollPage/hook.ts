import { useContracts } from '../../hooks/useContracts'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { randomchoice } from '@oasisprotocol/blockvote-contracts'
import { ethers, Transaction, TransactionReceipt, ZeroAddress } from 'ethers'
import { ConfiguredNetwork } from '../../utils/crypto.demo'
import { useEthereum } from '../../hooks/useEthereum'
import { DateUtils } from '../../utils/date.utils'
import { completePoll as doCompletePoll, destroyPoll as doDestroyPoll } from '../../utils/poll.utils'
import {
  configuredNetworkName,
  demoSettings,
  designDecisions,
  nativeTokenName,
  VITE_CONTRACT_POLLMANAGER,
  VITE_NETWORK_BIGINT,
} from '../../constants/config'
import { useTime } from '../../hooks/useTime'
import { tuneValue } from '../../utils/tuning'
import { Decision, deny, getVerdict, useAction, useLabel, useTextField } from '../../components/InputFields'
import { useExtendedPoll } from '../../hooks/useExtendedPoll'
import { useProposalFromChain } from '../../hooks/useProposalFromChain'
import { useNavigate } from 'react-router-dom'
import { isPollActive, shouldPublishVoters, shouldPublishVotes } from '../../types'
import classes from './index.module.css'
import { showGaslessPossible } from '../../components/icons/GasRequiredIcon'
import { hasTextMatch } from '../../components/HighlightedText/text-matching'

export const usePollData = (pollId: string) => {
  const navigate = useNavigate()
  const eth = useEthereum()
  const { userAddress, isHomeChain } = eth

  const [isVoting, setIsVoting] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [hasCompleted, setHasCompleted] = useState(false)
  const [selectedChoice, doSetSelectedChoice] = useState<bigint | undefined>()
  const [existingVote, setExistingVote] = useState<bigint | undefined>(undefined)
  const [isBusy, setIsBusy] = useState(false)

  const proposalId = `0x${pollId}`

  const Exp = /^[0-9a-z]+$/

  const isAlphanumeric = (char: string) => !!char.match(Exp)

  const {
    isLoading: isProposalLoading,
    error: proposalError,
    invalidateProposal,
    proposal,
  } = useProposalFromChain(proposalId)

  const {
    isDemo,
    isLoading,
    error,
    poll,
    deadline,
    setDeadline,
    completeDemoPoll,
    voteCounts,
    winningChoice,
    pollResults,
    gaslessEnabled,
    gaslessPossible,
    gvAddresses,
    gvBalances,
    invalidateGaslessStatus,
    isMine,
    permissions,
    permissionsPending,
    checkPermissions,
    correctiveAction,
  } = useExtendedPoll(proposal, { onDashboard: false })

  const { now } = useTime()
  const { pollManagerWithSigner: signerDao, gaslessVoting } = useContracts()

  const remainingTime = useMemo(
    () => (deadline ? DateUtils.calculateRemainingTimeFrom(deadline, now) : undefined),
    [deadline, now],
  )

  const remainingTimeString = useMemo(
    () => DateUtils.getTextDescriptionOfTime(remainingTime),
    [remainingTime],
  )

  const remainingTimeLabel = useLabel({
    name: 'remainingTime',
    value: remainingTimeString ?? '',
    tagName: 'h4',
    expandHorizontally: false,
  })

  const publishVotesLabel = useLabel({
    name: 'publishVotes',
    visible: shouldPublishVotes(poll?.proposal.params),
    value: 'Votes will be made public when the poll is completed.',
    tagName: 'div',
    classnames: classes.voteWarning,
  })

  const publishVotersLabel = useLabel({
    name: 'publishVoters',
    visible: shouldPublishVoters(poll?.proposal.params),
    value: 'The addresses of the voters will be made public when the poll is completed.',
    tagName: 'div',
    classnames: classes.voteWarning,
  })

  const isPastDue = !!remainingTime?.isPastDue

  let canSelect = false
  let canVote: Decision = false

  if (designDecisions.showSubmitButton) {
    canSelect =
      !remainingTime?.isPastDue &&
      winningChoice === undefined &&
      (eth.state.address === undefined || existingVote === undefined) &&
      !isVoting

    canVote =
      !eth.state.address && !isDemo
        ? deny('Waiting for wallet connection...')
        : isBusy
          ? deny('Doing something else now...')
          : winningChoice !== undefined
            ? deny('Poll is over!')
            : existingVote !== undefined
              ? deny('Already voted!')
              : selectedChoice === undefined
                ? deny('Please select an option first!')
                : getVerdict(permissions.canVote, false)
  } else {
    canSelect =
      (!!eth.state.address || isDemo) &&
      !remainingTime?.isPastDue &&
      winningChoice === undefined &&
      // (eth.state.address === undefined || existingVote === undefined) &&
      !isBusy &&
      winningChoice === undefined &&
      existingVote === undefined &&
      getVerdict(permissions.canVote, false) &&
      !isVoting
  }

  const hasWallet = isDemo || (isHomeChain && userAddress !== ZeroAddress)

  const walletLabel = useLabel({
    name: 'walletLabel',
    visible: !isPastDue && !hasWallet && !isDemo,
    classnames: classes.needWallet,
    value:
      !isHomeChain && userAddress !== ZeroAddress
        ? `To vote on this poll, please point your wallet to the **${configuredNetworkName}** by clicking
    the "Switch Network" button. This will open your wallet, and let you confirm that you
  want to connect to the ${configuredNetworkName}. Ensure you have enough ${nativeTokenName} for any
    transaction fees.`
        : `To vote on this poll, please **connect your wallet** by clicking the "Connect Wallet"
            button. This will open your wallet, and let you confirm the connection, and also point your wallet
            to the ${configuredNetworkName} network. Ensure you have enough ${nativeTokenName} for any
            transaction fees.`,
  })

  const gaslessLabel = useLabel<boolean | undefined>({
    name: 'gaslessIndicator',
    value: gaslessPossible,
    visible: getVerdict(permissions.canVote, false),
    renderer: possible => showGaslessPossible(possible, true),
  })

  const voteAction = useAction({
    name: 'vote',
    label: 'Submit vote',
    pendingLabel: 'Submitting vote',
    size: 'small',
    visible:
      hasWallet && getVerdict(permissions.canVote, false) && !isPastDue && designDecisions.showSubmitButton,
    enabled: canVote,
    action: () => {},
  })

  const resultsLabel = useLabel<string>({
    name: 'resultsLabel',
    value: '',
    expandHorizontally: false,
    tagName: 'h4',
  })

  const active = isPollActive(poll?.proposal?.params)

  const completePoll = useAction({
    name: 'completePoll',
    label: 'Complete poll',
    description: 'Close the poll and publish the results',
    pendingLabel: 'Completing poll',
    visible: isMine && hasWallet,
    confirmQuestion: "Are you sure you want to complete this poll? This can't be undone.",
    size: 'small',
    color: isMine && (isPastDue || !remainingTime) ? 'primary' : 'secondary',
    enabled: !signerDao
      ? deny('Waiting for connection to Poll Manager')
      : isBusy
        ? deny('Doing something else now')
        : deadline && !isPastDue
          ? deny("Can't close before the pre-defined time.")
          : true,
    action: async context => {
      try {
        await doCompletePoll(eth, signerDao!, proposalId, context)
        setHasCompleted(true)
      } catch (e) {
        console.log(JSON.stringify(e, null, '  '))
        throw new Error('Error completing poll')
      }
    },
  })

  const destroyPoll = useAction({
    name: 'destroyPoll',
    label: 'Destroy poll',
    description: 'Delete this poll from the system',
    size: 'small',
    color: 'secondary',
    pendingLabel: 'Destroying poll',
    visible: isMine && hasWallet,
    enabled: !signerDao
      ? deny('Waiting for connection to Poll Manager')
      : isBusy
        ? deny('Doing something else now')
        : true,
    confirmQuestion: "Are you you you want to destroy this poll? This can't be undone.",
    action: async context => {
      try {
        await doDestroyPoll(eth, signerDao!, proposalId, context)
        navigate('/')
      } catch (e: any) {
        console.log(JSON.stringify(e, null, '  '))
        throw new Error(typeof e === 'object' ? e.shortMessage : 'Error destroying poll')
      }
    },
  })

  useEffect(() => {
    setIsBusy(completePoll.isPending || destroyPoll.isPending || isVoting)
  }, [completePoll.isPending, destroyPoll.isPending, isVoting])

  const moveDemoAfterVoting = useCallback(() => {
    const remainingSeconds = remainingTime?.totalSeconds
    if (
      !!deadline &&
      !!remainingSeconds &&
      remainingSeconds > demoSettings.jumpToSecondsBeforeCompletion + demoSettings.timeContractionSeconds
    ) {
      // Let's quickly get rid of the remaining time.
      tuneValue({
        startValue: deadline,
        transitionTime: demoSettings.timeContractionSeconds,
        endValue:
          Date.now() / 1000 +
          demoSettings.jumpToSecondsBeforeCompletion +
          demoSettings.timeContractionSeconds,
        stepInMs: 100,
        setValue: setDeadline,
        easing: true,
      })
    } else {
      if (!deadline) {
        console.log('Not speeding up time, since there is no deadline.')
      } else if (!remainingSeconds) {
        console.log('Not speeding up time, since there is are no remainingSeconds.')
      } else {
        const threshold = demoSettings.jumpToSecondsBeforeCompletion + demoSettings.timeContractionSeconds
        if (remainingSeconds <= threshold) {
          console.log(
            'Not speeding up time, since we would need at least',
            threshold,
            'seconds, but we have only',
            remainingSeconds,
          )
        } else {
          console.log('i have no idea why are we not speeding up the time.')
        }
      }
    }
  }, [deadline, remainingTime, setDeadline])

  const [isSearchVisible, setSearchVisible] = useState(false)

  const choiceSearchInput = useTextField({
    name: 'choiceSearch',
    label: 'Search for option',
    initialValue: '',
    visible: isSearchVisible,
    autoFocus: true,
    onEnter: () => {
      const matching = poll?.ipfsParams.choices
        .map((choice, index) => ({ choice, index }))
        .filter(o => hasTextMatch(o.choice, [choiceSearchPattern]))
      // console.log('Matching choices are', matching)
      if (matching?.length === 1) {
        // console.log('Should select', matching[0])
        setSelectedChoice(BigInt(matching[0].index))
        choiceSearchInput.setValue('')
      }
    },
  })

  useEffect(() => setSearchVisible(!!choiceSearchInput.value), [choiceSearchInput.value])

  const choiceSearchPattern = useMemo(
    () => (choiceSearchInput.value.length ? choiceSearchInput.value : undefined),
    [choiceSearchInput.value],
  )

  useEffect(() => {
    // console.log('Should attach key handlers')

    const processEvent = (event: KeyboardEvent): void => {
      if (event.key.length === 1 && isAlphanumeric(event.key)) {
        choiceSearchInput.setValue(choiceSearchInput.value + event.key)
      }
    }

    if (!isSearchVisible) {
      document.addEventListener('keypress', processEvent)
    }
    return () => {
      // console.log('Remove handlers')
      document.removeEventListener('keypress', processEvent)
    }
  }, [isSearchVisible])

  const doVote = useCallback(
    async (choice: bigint | undefined): Promise<void> => {
      if (choice === undefined) throw new Error('no choice selected')

      if (isDemo) {
        return new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            if (
              confirm(
                "Are you sure you want to submit your vote? (Normally you should see a MetaMask popup at this point, but this demo doesn't require any wallet, so this will have to do...)",
              )
            ) {
              setExistingVote(choice)
              setHasVoted(true)
              moveDemoAfterVoting()
              resolve()
            } else {
              reject()
            }
          }, 1000)
        })
      }

      if (!gaslessVoting) throw new Error('No Gasless Voting!')
      if (!signerDao) throw new Error('No Signer Dao')

      let submitAndPay = true

      if (gaslessPossible) {
        if (!eth.state.signer) {
          throw new Error('No signer!')
        }

        const request = {
          dao: VITE_CONTRACT_POLLMANAGER,
          voter: userAddress,
          proposalId: proposalId,
          choiceId: choice,
        }

        // Sign voting request
        const signature = await eth.state.signer.signTypedData(
          {
            name: 'GaslessVoting',
            version: '1',
            chainId: VITE_NETWORK_BIGINT,
            verifyingContract: await gaslessVoting.getAddress(),
          },
          {
            VotingRequest: [
              { name: 'voter', type: 'address' },
              { name: 'dao', type: 'address' },
              { name: 'proposalId', type: 'bytes32' },
              { name: 'choiceId', type: 'uint256' },
            ],
          },
          request,
        )
        const rsv = ethers.Signature.from(signature)

        // Get nonce and random address
        const submitAddr = randomchoice(gvAddresses)
        const submitNonce = await eth.state.provider.getTransactionCount(submitAddr)
        console.log(`Gasless voting, chose address:${submitAddr} (nonce: ${submitNonce})`)

        // Submit voting request to get signed transaction
        const feeData = await eth.state.provider.getFeeData()
        console.log('doVote.gasless: constructing tx', 'gasPrice', feeData.gasPrice)
        const tx = await gaslessVoting.makeVoteTransaction(
          submitAddr,
          submitNonce,
          feeData.gasPrice!,
          request,
          permissions.proof,
          rsv,
        )

        // Submit pre-signed signed transaction
        let plain_resp
        let receipt: TransactionReceipt | null = null
        try {
          const txDecoded = Transaction.from(tx)
          const txDecodedGas = await eth.state.provider.estimateGas(txDecoded)
          console.log('TxDecodedGas', txDecodedGas)
          plain_resp = await eth.state.provider.broadcastTransaction(tx)
          console.log('doVote.gasless: waiting for tx', plain_resp.hash)
          receipt = await eth.state.provider.waitForTransaction(plain_resp.hash)
        } catch (e: any) {
          if ((e.message as string).includes('insufficient balance to pay fees')) {
            submitAndPay = true
            console.log('Insufficient balance!')
          } else {
            throw e
          }
        }

        // Transaction fails... oh noes
        if (receipt === null || receipt.status != 1) {
          // TODO: how can we tell if it failed due to out of gas?
          // Give them the option to re-submit their vote
          let tx_hash = ''
          if (receipt) {
            tx_hash = `\n\nFailed tx: ${receipt.hash}`
          }
          console.log('Receipt is', receipt)
          const result = confirm(
            `Error submitting from subsidy account, submit from your own account? ${tx_hash}`,
          )
          if (result) {
            submitAndPay = true
          } else {
            throw new Error(`gasless voting failed: ${receipt}`)
          }
        } else {
          console.log('doVote.gasless: success')
          submitAndPay = false
        }
      }

      if (submitAndPay) {
        console.log('doVote: casting vote using normal tx')
        await eth.switchNetwork(ConfiguredNetwork)
        const tx = await signerDao.vote(proposalId, choice, permissions.proof)
        const receipt = await tx.wait()

        if (receipt!.status != 1) throw new Error('cast vote tx failed')
      }

      setExistingVote(choice)
      setHasVoted(true)
    },
    [
      selectedChoice,
      gaslessVoting,
      signerDao,
      gaslessPossible,
      eth.state.signer,
      eth.state.provider,
      gvAddresses,
      permissions.proof,
      moveDemoAfterVoting,
    ],
  )

  async function vote(choice?: bigint): Promise<boolean> {
    try {
      setIsVoting(true)
      await doVote(choice ?? selectedChoice)
      setIsVoting(false)
      return true
    } catch (e) {
      let errorString = `${e}`
      if (errorString.startsWith('Error: user rejected action')) {
        errorString = 'The signer refused to sign this vote.'
      }
      window.alert(`Failed to submit vote: ${errorString}`)
      console.log(e)
      setIsVoting(false)
      return false
    }
  }

  const topUp = async (addr: string, amount: bigint) => {
    await eth.state.signer?.sendTransaction({
      to: addr,
      value: amount,
      data: '0x',
    })
    console.log('Top up finished, reloading...')
    invalidateGaslessStatus()
  }

  useEffect(
    // Complete the demo time if nothing more is going to happen
    () => {
      if (
        isDemo &&
        isPollActive(poll?.proposal.params) &&
        remainingTime?.isPastDue &&
        remainingTime.totalSeconds < demoSettings.waitSecondsBeforeFormallyCompleting + 5 &&
        remainingTime.totalSeconds >= demoSettings.waitSecondsBeforeFormallyCompleting
      ) {
        completeDemoPoll()
      }
    },
    [deadline, now],
  )

  // if (!isDemo && userAddress === "0x0000000000000000000000000000000000000000") {

  useEffect(() => {
    // Reload poll after completion, expecting results
    if (hasCompleted) {
      if (!poll) {
        // console.log("No poll loaded, waiting to load")
      } else if (isPollActive(poll.proposal.params)) {
        // console.log("Apparently, we have completed a poll, but we still perceive it as active, so scheduling a reload...")
        setTimeout(() => {
          // console.log("Reloading now")
          invalidateProposal()
        }, 5 * 1000)
      } else {
        // console.log("We no longer perceive it as active, so we can stop reloading")
        setHasCompleted(false)
      }
    }
  }, [hasCompleted, poll])

  const setSelectedChoice = async (value: bigint | undefined) => {
    if (designDecisions.showSubmitButton) {
      doSetSelectedChoice(value)
    } else {
      doSetSelectedChoice(value)
      if (value !== undefined) {
        if (!(await vote(value))) doSetSelectedChoice(undefined)
      }
    }
  }

  return {
    userAddress,
    hasWallet,
    walletLabel,
    isLoading: isProposalLoading || isLoading,
    error: proposalError ?? error,
    poll,
    choiceSearchInput,
    choiceSearchPattern,
    active,

    selectedChoice: winningChoice ?? selectedChoice,
    canSelect,
    setSelectedChoice,

    remainingTime,
    remainingTimeString,
    remainingTimeLabel,

    isMine,
    permissions,
    permissionsPending,
    checkPermissions,
    gaslessEnabled,
    gaslessLabel,
    gvAddresses,
    gvBalances,

    isVoting,
    hasVoted,
    existingVote,
    topUp,

    hasCompleted,
    voteAction,
    completePoll,
    destroyPoll,
    voteCounts,
    winningChoice,
    pollResults,
    correctiveAction,
    publishVotesLabel,
    publishVotersLabel,
    resultsLabel,
  }
}

export type PollData = ReturnType<typeof usePollData>

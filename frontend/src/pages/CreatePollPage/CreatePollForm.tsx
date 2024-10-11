import { Card } from '../../components/Card'
import { Layout } from '../../components/Layout'
import { useCreatePollForm } from './useCreatePollForm'
import { DottedProgressIndicator } from '../../components/DottedProgressIndicator'
import { InputFieldGroup } from '../../components/InputFields'
import { FC } from 'react'

export const CreatePollForm: FC = () => {
  const { stepIndex, numberOfSteps, fields } = useCreatePollForm()

  return (
    <Layout variation="dashboard">
      <Card>
        <InputFieldGroup fields={fields} />
      </Card>
      <DottedProgressIndicator steps={numberOfSteps} currentStepIndex={stepIndex} />
    </Layout>
  )
}

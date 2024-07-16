import { FC } from 'react';
import { Problem, ProblemLevel } from './util';
import classes from "./index.module.css";

const problemClass : Record<ProblemLevel, string> = {
  error: classes.fieldError,
  warning: classes.fieldWarning,
}

export const ProblemDisplay: FC<{problem: Problem, onRemove: (id: string) => void}> = ({problem, onRemove}) => {
  return (
    <div className = { problemClass[problem.level] } onClick={ () => onRemove(problem.id) } >
      { problem.message }
    </div>
  )
}
import type { ImageProviderAdaptor } from '../domain'
import { minimaxAdaptor } from './minimax'
import { stepfunPlanAdaptor } from './stepfun-plan'
import { stepfunAdaptor } from './stepfun'

export const defaultAdaptors: ImageProviderAdaptor[] = [minimaxAdaptor, stepfunAdaptor, stepfunPlanAdaptor]

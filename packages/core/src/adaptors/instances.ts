import type { ImageProviderAdaptor } from '../domain'
import { minimaxAdaptor } from './minimax'
import { sensenovaAdaptor } from './sensenova'
import { stepfunPlanAdaptor } from './stepfun-plan'
import { stepfunAdaptor } from './stepfun'

export const defaultAdaptors: ImageProviderAdaptor[] = [minimaxAdaptor, sensenovaAdaptor, stepfunAdaptor, stepfunPlanAdaptor]

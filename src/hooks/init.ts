import { Hook } from '@oclif/core'
import { registry } from '@ai-agg-agg/aaa-sdk'
import { ProvodAIAggregator } from '../index'

const hook: Hook<'init'> = async function () {
  registry.registerAggregator(new ProvodAIAggregator())
}

export default hook

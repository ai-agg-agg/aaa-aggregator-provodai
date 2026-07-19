import { registry } from '@ai-agg-agg/aaa-sdk';
import { ProvodAIAggregator } from '../index';
const hook = async function () {
    registry.registerAggregator(new ProvodAIAggregator());
};
export default hook;

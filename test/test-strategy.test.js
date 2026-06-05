import assert from 'node:assert/strict';
import test from 'node:test';

import { inferTestStrategyForTask } from '../src/test-strategy.js';

test('inferTestStrategyForTask only upgrades to weapp runtime for explicit runtime validation intent', () => {
  const runtimeStrategy = inferTestStrategyForTask({
    title: '微信小程序结果页按钮没反应，直接修一下并验证截图',
  });
  assert.deepEqual(runtimeStrategy.layers, ['integration', 'weapp']);
  assert.equal(runtimeStrategy.scope, 'weapp-runtime');
  assert.ok(runtimeStrategy.evidencePlan.includes('小程序运行态截图'));

  const copyStrategy = inferTestStrategyForTask({
    title: '微信小程序首页会员文案改短一点',
  });
  assert.notDeepEqual(copyStrategy.layers, ['integration', 'weapp']);
  assert.notEqual(copyStrategy.scope, 'weapp-runtime');
});

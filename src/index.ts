import { run } from './getSelfHostedRunner';
import * as core from '@actions/core';

run()
.then(() => {
    core.info("Success.");
})
.catch(core.setFailed);
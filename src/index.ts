import * as core from "@actions/core";
import { run } from "./getSelfHostedRunner";

run()
    .catch(core.setFailed);

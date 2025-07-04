#!/usr/bin/env groovy

properties([
        disableConcurrentBuilds(),
])

def allowed_branch_names = [
  'development': 'development',
  'mango_flow': 'development',
  'devops-image-build-refactor': 'development',
  'main': 'latest',
  'feature/schemas-in-irods': 'development'
]

def deploy_tier = [
  'development': 'test',
  'main': 'quality',
]

def publish = allowed_branch_names.containsKey(env.BRANCH_NAME)
def tag = ""
def tier = ""
if (publish) {
  tag = allowed_branch_names[env.BRANCH_NAME]
  if (deploy_tier.containsKey(env.BRANCH_NAME)) {
    tier = deploy_tier[env.BRANCH_NAME]
  }
}

// default for branche of extra packes from git(ea) repos: development
extraPackageBranch = 'development'
if ( env.BRANCH_NAME == 'main' ) {
  extraPackageBranch = 'main'
}

node() {
  deleteDir() // start from a clean sheet
  checkout scm // check out the base repo
  // now fetch the extra repos we want to include
  dir('extra-packages') {
    sh "git clone --single-branch -b ${extraPackageBranch} https://gitea.icts.kuleuven.be/foz/mangoflow-custom-tasks.git"
    sh "git clone --single-branch -b ${extraPackageBranch} https://gitea.icts.kuleuven.be/foz/mango-flow.git"
    sh "git clone --single-branch -b ${extraPackageBranch} https://gitea.icts.kuleuven.be/foz/mango-audit.git"
    sh "git clone --single-branch -b ${extraPackageBranch} https://gitea.icts.kuleuven.be/foz/mango-opensearch.git"
    sh "git clone --single-branch -b ${extraPackageBranch} https://gitea.icts.kuleuven.be/foz/cold-storage.git"
  }
  sh 'cp -rf extra-packages/mango-flow/src/mango_flow src/plugins'
  sh 'cp -rf extra-packages/mango-audit/src/mango_audit src/plugins'
  sh 'cp -rf extra-packages/mango-opensearch/src/mango_open_search src/plugins'
  sh 'cp -rf extra-packages/cold-storage/src/cold_storage src/plugins'

  // followed by the custom tasks
  sh 'cp -rf extra-packages/mangoflow-custom-tasks/src/fogcoa_validation.py src/plugins/mango_flow/tasks'
  sh 'cp -rf extra-packages/mangoflow-custom-tasks/src/fogcoa_tasks.py src/plugins/mango_flow/tasks'
  sh 'cp -rf extra-packages/mangoflow-custom-tasks/src/fiber.py src/plugins/mango_flow/tasks'
  sh 'find src/plugins'
  stash name: 'mango_plugins', includes: 'src/plugins/**/*'

  // static analysis
  sonarScanner {}

  buildDockerImage {
    namespace = 'foz'
    imageName = 'mango'
    imageTag = tag
    noPublish = !publish
    unstash = 'mango_plugins'
    labelFile = 'build-labels.json'
  }
}
if (tier!="") {
  stage("Deploy") {
     build job: '/team-faciliteiten-voor-onderzoek/gitea/nomadjobs/mango-portal/', wait: true, parameters: [
     [$class: 'StringParameterValue', name: 'Environment', value: tier]
     ]
  }
}

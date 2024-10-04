#!/usr/bin/env groovy

properties([
        disableConcurrentBuilds(),
])

def allowed_branch_names = [
  'development': 'development',
  'mango_flow': 'development',
  'devops-image-build-refactor': 'development',
  'main': 'latest'
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
node() {
  deleteDir() // start from a clean sheet
  checkout scm // check out the base repo
  // now fetch the extra repos we want to include
  dir('custom-packages') {
    sh 'git clone https://gitea.icts.kuleuven.be/foz/mangoflow-custom-tasks.git'
    sh 'git clone https://gitea.icts.kuleuven.be/foz/mango-flow.git'
  }
  // just for logging purposes
  sh 'find custom-packages'
  // copy first the relevant portion of mango_flow
  sh 'cp -rf custom-packages/mango-flow/src/mango_flow src/plugins'
  // followed by the custom tasks
  sh 'cp -rf custom-packages/mangoflow-custom-tasks/src/fogcoa_validation.py src/plugins/mango_flow/tasks'
  sh 'find src/plugins'
  // static analysis
  sonarScanner {}

  buildDockerImage {
    namespace = 'foz'
    imageName = 'mango'
    imageTag = tag
    noPublish = !publish
  }
}
if (tier!="") {
  stage("Deploy") {
     build job: '/team-faciliteiten-voor-onderzoek/gitea/nomadjobs/mango-portal/', wait: true, parameters: [
     [$class: 'StringParameterValue', name: 'Environment', value: tier]
     ]
  }
}

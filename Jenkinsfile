#!/usr/bin/env groovy

properties([
        disableConcurrentBuilds(),
])

def allowed_branch_names = [
  'development': 'development', 
  'main': 'latest'
]

def deploy_environment = [
  'development': 'test',
  'main': 'production',
]

def publish = allowed_branch_names.containsKey(env.BRANCH_NAME)
def tag = ""
def env = ""
if (publish) {
  tag = allowed_branch_names[env.BRANCH_NAME]
  if (deploy_environment.containsKey(env.BRANCH_NAME)) {
    env = deploy_environment[env.BRANCH_NAME]
  }
}
buildDockerImage {
  namespace = 'foz'
  imageName = 'mango'
  imageTag = tag 
  noPublish = !publish
}

if (env!="") {
  stage("Deploy") {
     build job: '/team-faciliteiten-voor-onderzoek/gitea/mango-portal/deploy/', wait: true, parameters: [
     [$class: 'StringParameterValue', name: 'Tier', value: env]
     ]
  }
}

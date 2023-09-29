#!/usr/bin/env groovy

properties([
        disableConcurrentBuilds(),
])

def allowed_branch_names = [
  'development': 'development',
  'search-data-platform': 'development',
  'main': 'latest'
]

def deploy_tier = [
  'development': 'test',
  'main': 'production',
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
buildDockerImage {
  namespace = 'foz'
  imageName = 'mango'
  imageTag = tag
  noPublish = !publish
}

if (tier!="") {
  stage("Deploy") {
     build job: '/team-faciliteiten-voor-onderzoek/gitea/mango-portal/deploy/', wait: true, parameters: [
     [$class: 'StringParameterValue', name: 'Tier', value: tier]
     ]
  }
}

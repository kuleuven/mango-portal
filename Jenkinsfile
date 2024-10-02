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
  deleteDir()
  checkout scm 
  dir('custom-packages') {
    sh 'git clone https://gitea.icts.kuleuven.be/foz/mangoflow-custom-tasks.git'
    sh 'git clone https://gitea.icts.kuleuven.be/foz/mango-flow.git'
  }
  sh 'find custom-packages'


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

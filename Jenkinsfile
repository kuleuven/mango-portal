#!/usr/bin/env groovy

properties([
        disableConcurrentBuilds(),
])

node (){
buildDockerImage {
  namespace = 'foz'
  imageName = 'mango'
  imageTag = 'latest'
  noPublish = env.BRANCH_NAME != 'development'
  noNode = true
}
}

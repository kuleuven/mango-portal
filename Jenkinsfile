#!/usr/bin/env groovy

properties([
        disableConcurrentBuilds(),
])

buildDockerImage {
  namespace = 'foz'
  imageName = 'mango'
  imageTag = 'latest'
  noPublish = env.BRANCH_NAME != 'development'
}

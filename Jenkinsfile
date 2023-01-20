#!/usr/bin/env groovy

properties([
        disableConcurrentBuilds(),
])

def publish = env.BRANCH_NAME == 'development'
buildDockerImage {
  namespace = 'foz'
  imageName = 'mango'
  imageTag = 'latest'
  noPublish = !publish
}

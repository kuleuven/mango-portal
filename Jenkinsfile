#!/usr/bin/env groovy

properties([
        disableConcurrentBuilds(),
])
def allowed_branch_names = ['development', 'data-platform-view']
def publish = allowed_branch_names.contains(env.BRANCH_NAME)
buildDockerImage {
  namespace = 'foz'
  imageName = 'mango'
  imageTag = 'latest'
  noPublish = !publish
}

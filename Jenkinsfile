#!/usr/bin/env groovy

properties([
        disableConcurrentBuilds(),
])

def allowed_branch_names = [
  'development': 'latest', 
  'data-platform-view': 'quality'
]

def publish = allowed_branch_names.containsKey(env.BRANCH_NAME)
def tag = ""
if (publish) {
  tag = allowed_branch_names[env.BRANCH_NAME]
}
buildDockerImage {
  namespace = 'foz'
  imageName = 'mango'
  imageTag = tag 
  noPublish = !publish
}

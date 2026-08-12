targetScope = 'resourceGroup'

@description('Name of the Azure Container Registry.')
param registryName string

@description('Principal ID of the Container App system-assigned managed identity.')
param principalId string

var acrPullRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '7f951dda-4ed3-4680-a7ca-43fe172d538d'
)

resource registry 'Microsoft.ContainerRegistry/registries@2025-04-01' existing = {
  name: registryName
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, principalId, acrPullRoleDefinitionId)
  scope: registry
  properties: {
    roleDefinitionId: acrPullRoleDefinitionId
    principalId: principalId
    principalType: 'ServicePrincipal'
    description: 'Allows the web Container App to pull images from this registry.'
  }
}

output roleAssignmentId string = acrPull.id

import type { AISettings } from '../entities/models';
import type { AIProvider } from './aiProvider';
import { OpenAICompatibleLocalProvider } from './openAICompatibleLocalProvider';
import { RuleBasedProvider } from './ruleBasedProvider';

export function getAIProvider(settings?: AISettings): AIProvider {
  if (settings?.providerName === 'OpenAICompatibleLocalProvider') {
    if (!settings.localEndpoint) throw new Error('The local model provider is selected, but its endpoint is missing. Open Settings and configure the local model server.');
    return new OpenAICompatibleLocalProvider({ endpoint: settings.localEndpoint, model: settings.localModel });
  }
  return new RuleBasedProvider();
}

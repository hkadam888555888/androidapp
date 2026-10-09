import type { AISettings } from '../entities/models';
import type { AIProvider } from './aiProvider';
import { OpenAICompatibleLocalProvider } from './openAICompatibleLocalProvider';
import { RuleBasedProvider } from './ruleBasedProvider';

export function getAIProvider(settings?: AISettings): AIProvider {
  if (settings?.providerName === 'OpenAICompatibleLocalProvider' && settings.localEndpoint) {
    try { return new OpenAICompatibleLocalProvider({ endpoint: settings.localEndpoint, model: settings.localModel }); }
    catch { return new RuleBasedProvider(); }
  }
  return new RuleBasedProvider();
}

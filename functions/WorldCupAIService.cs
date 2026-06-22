using Azure;
using Azure.AI.OpenAI;
using Azure.Core;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;

namespace WorldCup.Functions
{
    public class WorldCupAIService
    {
        private readonly ILogger<WorldCupAIService> _logger;
        private readonly string _instruction;
        private readonly OpenAIClient? _client;
        private readonly string? _deploymentName;

        public WorldCupAIService(ILogger<WorldCupAIService> logger)
        {
            _logger = logger;
            _instruction = Environment.GetEnvironmentVariable("AI_AGENT_INSTRUCTION") ?? "Summarize the latest world cup fixture data and produce a short analysis.";

            var endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
            var apiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");
            _deploymentName = Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT_NAME");

            if (!string.IsNullOrEmpty(endpoint) && !string.IsNullOrEmpty(apiKey) && !string.IsNullOrEmpty(_deploymentName))
            {
                _client = new OpenAIClient(new Uri(endpoint), new AzureKeyCredential(apiKey));
            }
        }

        public async Task<string> AnalyzeAsync(string worldCupData)
        {
            _logger.LogInformation("Analyzing world cup data with AI instruction.");

            if (_client is null || string.IsNullOrEmpty(_deploymentName))
            {
                _logger.LogWarning("OpenAI client is not configured; returning a placeholder summary.");
                return $"Instruction: {_instruction}\n\nData snapshot:\n{worldCupData}";
            }

            var prompt = $"{_instruction}\n\nWorld Cup data:\n{worldCupData}";
            var options = new ChatCompletionsOptions();
            options.Messages.Add(new ChatMessage(ChatRole.System, _instruction));
            options.Messages.Add(new ChatMessage(ChatRole.User, prompt));
            options.MaxTokens = 800;

            var response = await _client.GetChatCompletionsAsync(_deploymentName, options);
            return response.Value.Choices[0].Message.Content.Trim();
        }
    }
}
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Net;

namespace WorldCup.Functions
{
    public class GetFixtures
    {
        private readonly ILogger _logger;

        public GetFixtures(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<GetFixtures>();
        }

        [Function("GetFixtures")]
        public HttpResponseData Run([HttpTrigger(AuthorizationLevel.Function, "get")] HttpRequestData req)
        {
            _logger.LogInformation("C# HTTP trigger function processed a request.");

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "text/plain; charset=utf-8");

            response.WriteString("This HTTP triggered function executed successfully.");

            return response;
        }
    }
}
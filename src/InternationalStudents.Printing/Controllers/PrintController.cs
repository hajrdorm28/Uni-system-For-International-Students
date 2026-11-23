using System.Globalization;
using InternationalStudents.Printing.Configuration;
using InternationalStudents.Printing.Services;
using Microsoft.AspNetCore.Mvc;

namespace InternationalStudents.Printing.Controllers;

/// <summary>Returns a ready-to-print HTML page (A4 print CSS) for one student and one template.</summary>
[Route("print")]
public sealed class PrintController(IPaperService papers) : Controller
{
    // Papers never need scripts, images from other sites or forms.
    private const string PaperCsp =
        "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

    [HttpGet("{studentId:int:min(1)}/{templateCode}")]
    public async Task<IActionResult> Paper(int studentId, string templateCode, CancellationToken ct)
    {
        var requestedBy = ReadRequester();
        var page = await papers.GenerateAsync(studentId, templateCode, requestedBy, ct);

        Response.Headers.ContentSecurityPolicy = PaperCsp;
        return View("Paper", page);
    }

    private int ReadRequester()
    {
        if (Request.Headers.TryGetValue(SecurityOptions.UserHeaderName, out var values) &&
            values.Count == 1 &&
            int.TryParse(values[0], NumberStyles.None, CultureInfo.InvariantCulture, out var id) &&
            id >= 1)
        {
            return id;
        }

        throw new PrintingException(StatusCodes.Status400BadRequest,
            $"Header {SecurityOptions.UserHeaderName} must contain the numeric id of the staff user printing the paper.");
    }
}

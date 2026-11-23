using InternationalStudents.Printing.Domain;
using InternationalStudents.Printing.Services;
using Microsoft.AspNetCore.Mvc;

namespace InternationalStudents.Printing.Controllers;

[ApiController]
[Route("api/templates")]
public sealed class TemplatesController(IPaperService papers) : ControllerBase
{
    /// <summary>Active templates (print_template.is_active = 1) for the template picker.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TemplateSummary>>> GetAll(CancellationToken ct) =>
        Ok(await papers.GetTemplatesAsync(ct));
}

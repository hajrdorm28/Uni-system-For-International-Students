using System.ComponentModel.DataAnnotations;
using InternationalStudents.Printing.Data;
using InternationalStudents.Printing.Domain;
using Microsoft.AspNetCore.Mvc;

namespace InternationalStudents.Printing.Controllers;

[ApiController]
[Route("api/students")]
public sealed class StudentsController(IStudentRepository students) : ControllerBase
{
    /// <summary>Student picker. Search matches part of the name, or the exact student number.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StudentSummary>>> Search(
        [FromQuery, StringLength(100)] string? search,
        [FromQuery, Range(1, 200)] int limit = 50,
        [FromQuery, Range(0, 100_000)] int offset = 0,
        CancellationToken ct = default)
    {
        return Ok(await students.SearchAsync(search, limit, offset, ct));
    }
}

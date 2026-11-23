using InternationalStudents.Printing.Domain;
using InternationalStudents.Printing.Models;

namespace InternationalStudents.Printing.Services;

public interface IPaperService
{
    Task<IReadOnlyList<TemplateSummary>> GetTemplatesAsync(CancellationToken ct);

    /// <summary>Builds one printable paper and records the attempt in print_log.</summary>
    /// <exception cref="PrintingException">
    /// 403 requester is not ADMIN/ADVISOR; 404 unknown template or student; 422 the template cannot be filled.
    /// </exception>
    Task<PaperPage> GenerateAsync(int studentId, string templateCode, int requestedByUserId, CancellationToken ct);
}

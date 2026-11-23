using System.Security.Cryptography;

namespace InternationalStudents.Printing.Services;

/// <summary>
/// Generates print_log.reference_no (CHAR(12), unique). 12 random characters from a 32-symbol
/// alphabet without look-alikes (no 0/O, 1/I), so it can be read back from a printed paper.
/// </summary>
public static class ReferenceNumber
{
    public const int Length = 12;
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public static string Create() => new(RandomNumberGenerator.GetItems<char>(Alphabet, Length));
}

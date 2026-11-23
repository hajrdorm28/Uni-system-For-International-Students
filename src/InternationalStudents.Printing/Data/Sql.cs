using System.Data.Common;

namespace InternationalStudents.Printing.Data;

internal static class Sql
{
    /// <summary>Adds a named parameter; every value reaches SQL this way, never by concatenation.</summary>
    public static void AddParameter(this DbCommand command, string name, object? value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value ?? DBNull.Value;
        command.Parameters.Add(parameter);
    }

    /// <summary>Escapes LIKE wildcards so a search for "50%" matches the literal text.</summary>
    public static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}

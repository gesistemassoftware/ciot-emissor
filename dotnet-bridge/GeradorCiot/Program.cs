using System.Text.Json;
using GeradorCIOTShared;

if (args.Length < 1)
{
    Console.WriteLine(JsonSerializer.Serialize(new { ok = false, erro = "Informe o CNPJ como argumento." }));
    return 1;
}

var cnpj = args[0];

try
{
    var servico = new GeradorCIOTService_v3();
    var ciot = servico.GerarCIOT(cnpj);
    Console.WriteLine(JsonSerializer.Serialize(new { ok = true, ciot }));
    return 0;
}
catch (Exception ex)
{
    var mensagem = ex.Message;
    var inner = ex.InnerException;
    while (inner != null)
    {
        mensagem += " | " + inner.Message;
        inner = inner.InnerException;
    }
    Console.WriteLine(JsonSerializer.Serialize(new { ok = false, erro = mensagem }));
    return 1;
}

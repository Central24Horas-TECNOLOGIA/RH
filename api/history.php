<?php
header('Content-Type: text/plain; charset=utf-8');

$baseDir = __DIR__ . '/../data';
$csvFile = $baseDir . '/historico_testes.csv';

if (!is_dir($baseDir)) {
  mkdir($baseDir, 0777, true);
}

if (!file_exists($csvFile)) {
  file_put_contents(
    $csvFile,
    "id_teste,nome_candidato,vaga,nivel,trilha,data_iso,data_exibicao,pontuacao_final,status,tempo_minutos,arquivo_gabarito\n"
  );
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  readfile($csvFile);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $input = json_decode(file_get_contents('php://input'), true);

  if (!$input) {
    http_response_code(400);
    echo 'Payload inválido.';
    exit;
  }

  function csvValue($value)
  {
    $text = (string)($value ?? '');
    if (preg_match('/[",\n]/', $text)) {
      return '"' . str_replace('"', '""', $text) . '"';
    }
    return $text;
  }

  $line = implode(',', [
    csvValue($input['id_teste'] ?? ''),
    csvValue($input['nome_candidato'] ?? ''),
    csvValue($input['vaga'] ?? ''),
    csvValue($input['nivel'] ?? ''),
    csvValue($input['trilha'] ?? ''),
    csvValue($input['data_iso'] ?? ''),
    csvValue($input['data_exibicao'] ?? ''),
    csvValue($input['pontuacao_final'] ?? ''),
    csvValue($input['status'] ?? ''),
    csvValue($input['tempo_minutos'] ?? ''),
    csvValue($input['arquivo_gabarito'] ?? '')
  ]) . PHP_EOL;

  file_put_contents($csvFile, $line, FILE_APPEND | LOCK_EX);
  echo 'OK';
  exit;
}

http_response_code(405);
echo 'Método não permitido.';

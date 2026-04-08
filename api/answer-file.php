<?php
header('Content-Type: application/json; charset=utf-8');

$baseDir = __DIR__ . '/../data';
$jsonFile = $baseDir . '/gabaritos.json';

if (!is_dir($baseDir)) {
  mkdir($baseDir, 0777, true);
}

if (!file_exists($jsonFile)) {
  file_put_contents($jsonFile, '{}');
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  readfile($jsonFile);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $input = json_decode(file_get_contents('php://input'), true);

  if (!$input || empty($input['recordId']) || empty($input['payload'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Payload inválido.']);
    exit;
  }

  $recordId = $input['recordId'];
  $payload = $input['payload'];

  $current = json_decode(file_get_contents($jsonFile), true);
  if (!is_array($current)) {
    $current = [];
  }

  $current[$recordId] = $payload;

  file_put_contents(
    $jsonFile,
    json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
    LOCK_EX
  );

  echo json_encode(['success' => true]);
  exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método não permitido.']);

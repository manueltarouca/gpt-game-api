# persistence

resource "aws_dynamodb_table" "game_table" {
  name         = "GameTable"
  billing_mode = "PAY_PER_REQUEST"
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "entityType"
    type = "S"
  }

  attribute {
    name = "characterId"
    type = "S"
  }

  global_secondary_index {
    name            = "EntityTypeIndex"
    hash_key        = "entityType"
    range_key       = "SK"
    projection_type = "ALL"

  }

  global_secondary_index {
    name            = "CharacterIdIndex"
    hash_key        = "characterId"
    range_key       = "SK"
    projection_type = "ALL"
  }

  hash_key  = "PK"
  range_key = "SK"

}

# compute

resource "aws_iam_role" "lambda_role" {
  name = "lambda_memory_service_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement : [{
      Effect = "Allow",
      Principal : { Service : "lambda.amazonaws.com" },
      Action : "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_policy_attachment" "lambda_basic_execution" {
  name       = "lambda_basic_execution"
  roles      = [aws_iam_role.lambda_role.name]
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "dynamodb_policy" {
  name = "dynamodb_policy"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement : [{
      Effect = "Allow",
      Action = [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
      ],
      Resource = [
        "${aws_dynamodb_table.game_table.arn}",
        "${aws_dynamodb_table.game_table.arn}/*",
      ]
    }]
  })
}

resource "aws_iam_policy_attachment" "lambda_dynamodb_policy_attach" {
  name       = "lambda_policy_attachment"
  roles      = [aws_iam_role.lambda_role.name]
  policy_arn = aws_iam_policy.dynamodb_policy.arn
}

resource "aws_lambda_function" "game_function" {
  filename         = data.archive_file.lambda_function.output_path
  function_name    = "memoryFunction"
  role             = aws_iam_role.lambda_role.arn
  handler          = "handler.handler"
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.lambda_function.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.game_table.name
    }
  }

  depends_on = [
    aws_iam_policy_attachment.lambda_basic_execution,
    aws_iam_policy_attachment.lambda_dynamodb_policy_attach,
  ]
}

# API

resource "aws_api_gateway_rest_api" "game_api" {
  name = "GameAPI"
  endpoint_configuration {
    types = ["REGIONAL"]
  }

  body = local.api_body
}

resource "aws_api_gateway_deployment" "api_deployment" {
  rest_api_id = aws_api_gateway_rest_api.game_api.id
  stage_name  = "prod"
  triggers = {
    redeployment = sha1(jsonencode({
      lambda_hash   = data.archive_file.lambda_function.output_base64sha256,
      api_body_hash = sha1(local.api_body)
    }))
  }
  depends_on = [
    aws_api_gateway_rest_api.game_api,
    aws_lambda_permission.apigw_lambda_permission
  ]

  lifecycle {
    create_before_destroy = true
  }
}



resource "aws_lambda_permission" "apigw_lambda_permission" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.game_function.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.game_api.execution_arn}/*/*"
}

# authorizer

resource "aws_api_gateway_api_key" "game_api_key" {
  name    = "game_api_key"
  enabled = true
}

resource "aws_api_gateway_usage_plan" "game_usage_plan" {
  name = "game_usage_plan"

  api_stages {
    api_id = aws_api_gateway_rest_api.game_api.id
    stage  = aws_api_gateway_deployment.api_deployment.stage_name
  }
}

resource "aws_api_gateway_usage_plan_key" "example_usage_plan_key" {
  key_id        = aws_api_gateway_api_key.game_api_key.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.game_usage_plan.id
}


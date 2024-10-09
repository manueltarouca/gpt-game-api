data "aws_region" "current" {}

data "archive_file" "lambda_function" {
  type             = "zip"
  source_file      = "${path.module}/../backend/dist/handler.js"
  output_file_mode = "0666"
  output_path      = "${path.module}/files/function.zip"
}

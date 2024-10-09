locals {
  api_body = templatefile("${path.module}/api.yml", {
    region     = data.aws_region.current.name,
    lambda_arn = aws_lambda_function.game_function.arn
  })
}

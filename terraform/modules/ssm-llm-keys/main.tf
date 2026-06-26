variable "parameter_name" {
  type        = string
  description = "SSM SecureString path for JSON LLM env blob"
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "aws_ssm_parameter" "llm_env" {
  name  = var.parameter_name
  type  = "SecureString"
  value = jsonencode({ SCION_LLM_DEFAULT_PROVIDER = "openai" })
  tags  = var.tags

  lifecycle {
    ignore_changes = [value]
  }
}

output "parameter_name" {
  value = aws_ssm_parameter.llm_env.name
}

output "parameter_arn" {
  value = aws_ssm_parameter.llm_env.arn
}

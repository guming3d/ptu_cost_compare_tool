import unittest
import json
from pathlib import Path

from utils import (
    build_calculation_explanation,
    calculate_paygo_cost,
    calculate_provisioned_ptu_num,
    calculate_ptu_cost,
    round_up_ptus,
)


class ProvisionedThroughputTests(unittest.TestCase):
    def test_rounds_to_scale_increment_after_minimum(self):
        self.assertEqual(round_up_ptus(16, 15, 5), 20)
        self.assertEqual(round_up_ptus(3, 15, 5), 15)

    def test_gpt_5_2_documented_example(self):
        required, deployed, input_tpm, output_tpm, normalized_tpm = calculate_provisioned_ptu_num(
            input_token=200,
            image_input_token=0,
            output_token=20,
            peak_calls_per_min=1000,
            minimum_ptus=15,
            scale_increment=5,
            input_tpm_per_ptu=3400,
            output_to_input_ratio=8,
        )

        self.assertAlmostEqual(required, 105.8823529)
        self.assertEqual(deployed, 110)
        self.assertEqual(input_tpm, 200000)
        self.assertEqual(output_tpm, 20000)
        self.assertEqual(normalized_tpm, 360000)

    def test_cached_tokens_do_not_consume_ptu_capacity(self):
        required, deployed, *_ = calculate_provisioned_ptu_num(
            input_token=200,
            image_input_token=0,
            output_token=20,
            peak_calls_per_min=1000,
            minimum_ptus=15,
            scale_increment=5,
            input_tpm_per_ptu=3400,
            output_to_input_ratio=8,
            cache_hit_rate=50,
        )

        self.assertAlmostEqual(required, 76.4705882)
        self.assertEqual(deployed, 80)

    def test_cost_uses_scale_increment_not_minimum(self):
        self.assertEqual(
            calculate_ptu_cost(16, 15, 260, 0, scale_increment=5),
            5200,
        )

    def test_catalog_contains_verified_current_models(self):
        config = json.loads(Path("model_config.json").read_text())
        models = config["models"]
        names = {model["model name"] for model in models}

        self.assertEqual(config["metadata"]["verified date"], "2026-08-10")
        self.assertIn("azure openai gpt-5.6-luna (2026-07-09)", names)
        self.assertIn("azure openai o4-mini (2025-04-16)", names)
        self.assertIn("fireworks DeepSeek v3.2", names)
        self.assertIn("fireworks MiniMax M3", names)

    def test_paygo_loader_supports_catalog_metadata(self):
        cost = calculate_paygo_cost(
            input_token=1000,
            output_token=1000,
            rpm=0,
            model_name="azure openai gpt-5.6-luna (2026-07-09)",
        )
        self.assertEqual(cost, 0)

    def test_explanation_reproduces_azure_row_outputs(self):
        model_config = {
            "input token price per 1k": 0.00175,
            "input token price per 1k with cache hit": 0.000175,
            "output token price per 1k": 0.014,
            "output token multiple ratio": 8,
            "input TPM per PTU": 3400,
        }
        explanation = build_calculation_explanation(
            model_name="azure openai gpt-5.2 (2025-12-11)",
            provider="Azure OpenAI",
            model_config=model_config,
            input_text_tokens=200,
            input_image_tokens=0,
            output_tokens=20,
            rpm=1000,
            cache_hit_rate=0,
            required_ptus=105.8823529,
            minimum_ptus=15,
            scale_increment=5,
            ptu_price_per_unit=260,
            ptu_discount=0,
            paygo_cost=10000,
            ptu_cost=28600,
            tpm_per_dollar=1.2,
            cost_saving_percentage="-186.00%",
            commitment_type="Monthly",
            deployment_type="Global / Data Zone",
            ptu_metrics={
                "effective_text_input": 200,
                "total_input_tpm": 200000,
                "total_output_tpm": 20000,
                "normalized_tpm": 360000,
            },
        )

        steps = {step["output"]: step for step in explanation["steps"]}
        self.assertAlmostEqual(steps["Required PTU Num"]["result"], 105.8823529)
        self.assertEqual(steps["Deployable PTUs"]["result"], 110)
        self.assertAlmostEqual(
            steps["PTU Utilization"]["result"],
            105.8823529 / 110 * 100,
        )
        self.assertEqual(steps["PTU cost"]["result"], 28600)
        self.assertIn("360,000.00", steps["Required PTU Num"]["substitution"])

    def test_explanation_supports_manual_fireworks_sizing(self):
        explanation = build_calculation_explanation(
            model_name="fireworks GLM 5.2",
            provider="Fireworks on Microsoft Foundry",
            model_config={
                "input token price per 1k": 0.00154,
                "input token price per 1k with cache hit": 0.00015,
                "output token price per 1k": 0.00484,
            },
            input_text_tokens=3500,
            input_image_tokens=0,
            output_tokens=300,
            rpm=60,
            cache_hit_rate=10,
            required_ptus=401,
            minimum_ptus=400,
            scale_increment=200,
            ptu_price_per_unit=260,
            ptu_discount=0,
            paygo_cost=1234,
            ptu_cost=156000,
            tpm_per_dollar=0.1,
            cost_saving_percentage="-12543.44%",
            commitment_type="Monthly",
            deployment_type="Configured default",
        )

        steps = {step["output"]: step for step in explanation["steps"]}
        self.assertEqual(steps["Required PTU Num"]["result"], 401)
        self.assertEqual(steps["Deployable PTUs"]["result"], 600)
        self.assertIn("user supplied", steps["Required PTU Num"]["formula"])


if __name__ == "__main__":
    unittest.main()

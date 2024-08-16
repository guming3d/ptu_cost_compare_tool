import streamlit as st
import json
import os
from utils import calculate_ptu_num, calculate_ptu_utilization, calculate_paygo_cost, calculate_ptu_cost

# Load model configuration
config_path = os.path.join(os.path.dirname(__file__), 'model_config.json')
with open(config_path, 'r') as f:
    model_config = json.load(f)

# Extract model names for dropdown
model_list = [model["model name"] for model in model_config]

# Streamlit UI
st.title("Model PTU Cost Calculator")

input_token = st.number_input("Input Token Number", min_value=0, value=3500)
output_token = st.number_input("Output Token Number", min_value=0, value=300)
rpm = st.number_input("RPM (Request per minute)", min_value=0, value=60)
model_name = st.selectbox("Model Name", model_list)
ptu_num = st.number_input("PTU Number", min_value=0.0, format="%.2f")
ptu_subscription_type = st.selectbox("PTU Subscription Type", ["Monthly", "Yearly"])

if model_name:
    # Get model-specific configuration
    selected_model_config = next((model for model in model_config if model["model name"] == model_name), None)
    if selected_model_config:
        min_ptu_deployment_unit = selected_model_config["PTU minumum deployment unit"]
        ptu_price_per_unit = selected_model_config[f"PTU price of {ptu_subscription_type.lower()} reservation"]

    if st.button("Add Compare"):
        result = {
            "Model Name": model_name,
            "Input Token Number": input_token,
            "Output Token Number": output_token,
            "RPM": rpm,
            "Reservation Type": ptu_subscription_type,
            "PTU Num": calculate_ptu_num(input_token, output_token, rpm, ptu_num),
            "PTU Utilization": calculate_ptu_utilization(ptu_num, min_ptu_deployment_unit),
            "PayGO cost": calculate_paygo_cost(input_token, output_token, rpm, model_name),
            "PTU cost": calculate_ptu_cost(ptu_num, min_ptu_deployment_unit, ptu_price_per_unit),
        }
        # Convert result to markdown table format
        table_header = " | ".join(result.keys())
        table_separator = " | ".join(["---"] * len(result))
        table_values = " | ".join(map(str, result.values()))
        st.markdown(f"| {table_header} |\n| {table_separator} |\n| {table_values} |")

# Command line interface
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Model PTU Cost Calculator")
    parser.add_argument("--input_token", type=int, required=True, help="Input Token Number")
    parser.add_argument("--output_token", type=int, required=True, help="Output Token Number")
    parser.add_argument("--rpm", type=int, required=True, help="RPM (Request per minute)")
    parser.add_argument("--model_name", type=str, required=True, choices=model_list, help="Model Name")
    parser.add_argument("--ptu_num", type=int, required=True, help="PTU Number")
    parser.add_argument("--ptu_subscription_type", type=str, required=True, choices=["Monthly", "Yearly"], help="PTU Subscription Type")
    parser.add_argument("--ptu_price_per_unit", type=float, required=True, help="PTU Price for Each Unit (USD)")

    args = parser.parse_args()

    result = {
        "Model Name": args.model_name,
        "Input Token Number": args.input_token,
        "Output Token Number": args.output_token,
        "RPM": args.rpm,
        "Reservation Type": args.ptu_subscription_type,
        "PTU Num": calculate_ptu_num(args.input_token, args.output_token, args.rpm, args.ptu_num),
        "PTU Utilization": calculate_ptu_utilization(args.ptu_num, args.min_ptu_deployment_unit),
        "PayGO cost": calculate_paygo_cost(args.input_token, args.output_token, args.rpm, args.model_name),
        "PTU cost": calculate_ptu_cost(args.ptu_num, args.ptu_price_per_unit, args.ptu_subscription_type),
    }

    # Convert result to markdown table format
    table_header = " | ".join(result.keys())
    table_separator = " | ".join(["---"] * len(result))
    table_values = " | ".join(map(str, result.values()))
    print(f"| {table_header} |\n| {table_separator} |\n| {table_values} |")

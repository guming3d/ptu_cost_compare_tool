import math

def calculate_token_number(width, height, detail_level, model):
    """
    Calculate the token cost for processing an image based on the model, image dimensions,
    and level of detail.

    Parameters:
    - width (int): The width of the image in pixels.
    - height (int): The height of the image in pixels.
    - detail_level (str): 'low' or 'high', representing the level of image detail.
    - model (str): The model name ('GPT-4o', 'GPT-4 Turbo with Vision', or 'GPT-4o mini').

    Returns:
    - int: The total token cost for processing the image.
    """
    if detail_level.lower() not in ['low', 'high']:
        raise ValueError("Invalid detail level. Must be 'low' or 'high'.")
    
    detail_level = detail_level.lower()
    model = model.strip()

    if model in ['GPT-4o', 'GPT-4 Turbo with Vision']:
        # Standard models
        if detail_level == 'low':
            return 85  # Flat rate for low detail
        else:  # High detail
            token_cost_per_tile = 170
            base_token_cost = 85
    elif model == 'GPT-4o mini':
        # Mini model
        if detail_level == 'low':
            return 2833  # Flat rate for low detail
        else:
            token_cost_per_tile = 5667
            base_token_cost = 2833
    else:
        raise ValueError("Invalid model name. Must be 'GPT-4o', 'GPT-4 Turbo with Vision', or 'GPT-4o mini'.")

    # High detail mode calculations
    # Step 1: Resize image to fit within a 2048 x 2048 pixel square
    scaling_factor = min(2048 / width, 2048 / height, 1.0)
    resized_width = width * scaling_factor
    resized_height = height * scaling_factor

    # Step 2: If the shortest side > 768 pixels, resize so the shortest side is 768 pixels
    shortest_side = min(resized_width, resized_height)
    if shortest_side > 768:
        scaling_factor_2 = 768 / shortest_side
        resized_width *= scaling_factor_2
        resized_height *= scaling_factor_2

    # Step 3: Calculate the number of 512 x 512 pixel tiles
    tiles_w = math.ceil(resized_width / 512)
    tiles_h = math.ceil(resized_height / 512)
    total_tiles = tiles_w * tiles_h

    # Step 4: Calculate the total token cost
    token_cost = int(total_tiles * token_cost_per_tile + base_token_cost)

    return token_cost

if __name__ == "__main__":
    # Example inputs
    width = 2048    # Width of the image in pixels
    height = 4096   # Height of the image in pixels
    detail_level = 'high'  # 'low' or 'high'
#    model = 'GPT-4o mini'  # 'GPT-4o', 'GPT-4 Turbo with Vision', or 'GPT-4o mini'
    model = 'GPT-4o'  # 'GPT-4o', 'GPT-4 Turbo with Vision', or 'GPT-4o mini'

    # Calculate the token cost
    token_cost = calculate_token_number(width, height, detail_level, model)

    # Display the results
    print(f"Image dimensions: {width} x {height} pixels")
    print(f"Detail level: {detail_level}")
    print(f"Model: {model}")
    print(f"The total token number is: {token_cost}")

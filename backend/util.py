def sanitize_input(s):
        return str(s).replace("{","{{").replace("}","}}")
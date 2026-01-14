import os
if os.path.exists('.env'):
    print(open('.env').read())

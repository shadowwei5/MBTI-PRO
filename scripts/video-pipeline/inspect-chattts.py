import ChatTTS, inspect
chat=ChatTTS.Chat()
print('Chat methods:', [m for m in dir(chat) if not m.startswith('_')])
for name in dir(chat):
    if any(k in name.lower() for k in ['spk','speaker','sample','infer','load']):
        obj=getattr(chat,name)
        print('\n', name, obj)
        try: print(inspect.signature(obj))
        except Exception as e: print('sig err', e)
print('InferCodeParams', inspect.signature(ChatTTS.Chat.InferCodeParams))
print('RefineTextParams', inspect.signature(ChatTTS.Chat.RefineTextParams))

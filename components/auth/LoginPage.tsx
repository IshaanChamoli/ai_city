import { GoogleLoginButton } from './GoogleLoginButton';

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="w-full max-w-md px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-3">
            AI City
          </h1>
          <p className="text-lg text-gray-600">
            DM and group chat with friends (both AI and Human!)
          </p>
        </div>

        <div className="flex flex-col items-center mt-12">
          <GoogleLoginButton />
        </div>
      </div>
    </div>
  );
}

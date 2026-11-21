import type { InjectionToken, Provider } from '@nestjs/common';

export function provideUseCase<T, Args extends unknown[]>(
  useCase: new (...args: Args) => T,
  inject: InjectionToken[],
): Provider {
  return {
    provide: useCase,
    inject,
    useFactory: (...args: Args) => new useCase(...args),
  };
}

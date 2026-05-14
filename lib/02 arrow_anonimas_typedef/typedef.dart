main(){
}

void chamarUmaFuncaoDeUmParametro(FuncaoQueRecebeNome funcaoQueRecebeONome){
var calculo = 1+1;
var nomeCompleto = 'Rennan';
print('Finalizando a funcao chamarUmaFuncaoDeUmParametro');
print('invocando funcaoQueRecebeONome');
funcaoQueRecebeONome(nomeCompleto);
}



typedef FuncaoQueRecebeNome = void Function(String nome);

// Complexo

void funx2(FuncaoQueRecebeNomeComplexo nome){} // Declarando a funcao


typedef FuncaoQueRecebeNomeComplexo = String Function(String nome, String nomeCompleto,{
required String? x, required String? x2, int? qq});
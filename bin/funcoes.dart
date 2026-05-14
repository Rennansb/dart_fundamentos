import 'package:dart_fundamentos/01%20funcoes/02%20parametros_nomeados.dart';
import 'package:dart_fundamentos/01%20funcoes/01%20parametros_obrigatorios_default.dart';
import 'package:dart_fundamentos/01%20funcoes/03%20parametros_nomeados_obrigatorios.dart';
import 'package:dart_fundamentos/01%20funcoes/04%20parametros_nomeados_obrigatorios_default.dart';

void main(){
//Valor default
final valorCalculado = somaInteiros(10,10);
print(valorCalculado);

print("/////////////////////////");
// Nomeado
final valorCalculadoDouble = somaDoubles(numero2: 10,);
print(valorCalculadoDouble);

print("/////////////////////////");
// Nomeado Obrigatorio
final valorCalculadoDouble2 = somaDoubles2(numero2: 10,numero1: null);
print(valorCalculadoDouble2);
print("/////////////////////////");

// Nomeado Obrigatorio default
final valorCalculadoDouble3 = somaDoubles3();
print(valorCalculadoDouble3);

}